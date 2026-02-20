import { Request } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';

export interface TelemetryData {
  userId: string;
  email: string;
  eventType: string;
  // From request headers (server-side)
  ipAddress?: string;
  userAgent?: string;
  acceptLanguage?: string;
  // From frontend (client-side)
  browserLanguage?: string;
  browserTimezone?: string;
  referrer?: string;
  // Extra context
  metadata?: Record<string, unknown>;
}

/**
 * Extract telemetry data from an Express request
 */
export function extractRequestData(req: Request): {
  ipAddress: string;
  userAgent: string;
  acceptLanguage: string;
  referrer: string;
} {
  // IP: check X-Forwarded-For (behind nginx), then X-Real-IP, then socket
  const forwarded = req.headers['x-forwarded-for'];
  let ipAddress = 'unknown';
  if (typeof forwarded === 'string') {
    ipAddress = forwarded.split(',')[0].trim();
  } else if (Array.isArray(forwarded)) {
    ipAddress = forwarded[0]?.split(',')[0]?.trim() || 'unknown';
  } else if (req.headers['x-real-ip']) {
    ipAddress = req.headers['x-real-ip'] as string;
  } else if (req.socket.remoteAddress) {
    ipAddress = req.socket.remoteAddress;
  }

  const userAgent = (req.headers['user-agent'] as string) || 'unknown';
  const acceptLanguage = (req.headers['accept-language'] as string) || '';
  const referrer = (req.headers['referer'] as string) || (req.headers['referrer'] as string) || '';

  return { ipAddress, userAgent, acceptLanguage, referrer };
}

/**
 * Record a user event in Postgres (structured) and Neo4j (graph relationships)
 */
export async function recordEvent(data: TelemetryData): Promise<void> {
  // Fire both in parallel — don't let one failure block the other
  await Promise.allSettled([
    recordPostgresEvent(data),
    recordNeo4jEvent(data),
  ]);
}

async function recordPostgresEvent(data: TelemetryData): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO user_events (user_id, event_type, ip_address, user_agent, accept_language, browser_language, browser_timezone, referrer, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        data.userId,
        data.eventType,
        data.ipAddress || null,
        data.userAgent || null,
        data.acceptLanguage || null,
        data.browserLanguage || null,
        data.browserTimezone || null,
        data.referrer || null,
        JSON.stringify(data.metadata || {}),
      ]
    );
  } catch (err) {
    console.error('Failed to record Postgres event:', err);
  }
}

async function recordNeo4jEvent(data: TelemetryData): Promise<void> {
  const session = getDriver().session();
  try {
    // Parse useful signals
    const emailDomain = data.email.split('@')[1] || 'unknown';
    const primaryLanguage = parsePrimaryLanguage(data.acceptLanguage || '');
    const deviceType = parseDeviceType(data.userAgent || '');
    const browserName = parseBrowserName(data.userAgent || '');
    const osName = parseOsName(data.userAgent || '');

    // MERGE the User node (idempotent — created once, updated on each event)
    // MERGE a Location node from the IP (we store IP; geolocation can be enriched later)
    // MERGE a Device node from user agent fingerprint
    // CREATE the Session/Event node (always new)
    await session.run(
      `
      // Ensure User node exists
      MERGE (u:User {id: $userId})
      ON CREATE SET u.email = $email, u.emailDomain = $emailDomain, u.createdAt = datetime()
      ON MATCH SET u.lastSeenAt = datetime()

      // Ensure EmailDomain node exists (for company clustering)
      MERGE (d:EmailDomain {domain: $emailDomain})
      ON CREATE SET d.createdAt = datetime()
      MERGE (u)-[:HAS_EMAIL_DOMAIN]->(d)

      // Create event
      CREATE (e:Event {
        type: $eventType,
        ipAddress: $ipAddress,
        userAgent: $userAgent,
        acceptLanguage: $acceptLanguage,
        browserLanguage: $browserLanguage,
        browserTimezone: $browserTimezone,
        referrer: $referrer,
        primaryLanguage: $primaryLanguage,
        deviceType: $deviceType,
        browserName: $browserName,
        osName: $osName,
        createdAt: datetime()
      })
      MERGE (u)-[:PERFORMED]->(e)

      // Merge Location node (by IP — enriched later with geo)
      WITH u, e
      WHERE $ipAddress IS NOT NULL AND $ipAddress <> 'unknown'
      MERGE (loc:IPAddress {ip: $ipAddress})
      ON CREATE SET loc.firstSeen = datetime()
      SET loc.lastSeen = datetime()
      MERGE (e)-[:FROM_IP]->(loc)
      MERGE (u)-[:SEEN_FROM]->(loc)

      // Merge Device node (by user agent fingerprint)
      WITH u, e
      WHERE $userAgent IS NOT NULL AND $userAgent <> 'unknown'
      MERGE (dev:Device {fingerprint: $deviceFingerprint})
      ON CREATE SET dev.userAgent = $userAgent, dev.deviceType = $deviceType,
                    dev.browserName = $browserName, dev.osName = $osName, dev.firstSeen = datetime()
      SET dev.lastSeen = datetime()
      MERGE (e)-[:USING_DEVICE]->(dev)
      MERGE (u)-[:USES]->(dev)

      // Merge Language node
      WITH u, e
      WHERE $primaryLanguage IS NOT NULL AND $primaryLanguage <> ''
      MERGE (lang:Language {code: $primaryLanguage})
      MERGE (u)-[:PREFERS_LANGUAGE]->(lang)
      `,
      {
        userId: data.userId,
        email: data.email,
        emailDomain,
        eventType: data.eventType,
        ipAddress: data.ipAddress || 'unknown',
        userAgent: data.userAgent || 'unknown',
        acceptLanguage: data.acceptLanguage || '',
        browserLanguage: data.browserLanguage || '',
        browserTimezone: data.browserTimezone || '',
        referrer: data.referrer || '',
        primaryLanguage,
        deviceType,
        browserName,
        osName,
        deviceFingerprint: simpleFingerprint(data.userAgent || ''),
      }
    );
  } catch (err) {
    console.error('Failed to record Neo4j event:', err);
  } finally {
    await session.close();
  }
}

// --- Parsing helpers ---

function parsePrimaryLanguage(acceptLanguage: string): string {
  // "en-GB,en;q=0.9,de;q=0.8" → "en"
  if (!acceptLanguage) return '';
  const first = acceptLanguage.split(',')[0];
  return first.split('-')[0].split(';')[0].trim().toLowerCase();
}

function parseDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'mobile';
  if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet';
  return 'desktop';
}

function parseBrowserName(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('chrome') && !ua.includes('edg/')) return 'Chrome';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
  if (ua.includes('opera') || ua.includes('opr/')) return 'Opera';
  return 'Other';
}

function parseOsName(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macOS';
  if (ua.includes('linux') && !ua.includes('android')) return 'Linux';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
  return 'Other';
}

function simpleFingerprint(userAgent: string): string {
  // Simple hash-like fingerprint from user agent
  // Not cryptographic — just groups same browser/OS/device combos
  const browser = parseBrowserName(userAgent);
  const os = parseOsName(userAgent);
  const device = parseDeviceType(userAgent);
  return `${browser}/${os}/${device}`;
}
