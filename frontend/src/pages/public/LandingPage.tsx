import { Link } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="nav-logo">CRANIS<span>2</span></div>
        <div className="nav-links">
          <Link to="/login" className="btn btn-outline">Log In</Link>
          <Link to="/signup" className="btn btn-primary">Get Started</Link>
        </div>
      </nav>

      <section className="hero">
        <h1>CRA Compliance<br /><span>Made Simple</span></h1>
        <p>
          CRANIS2 helps software organisations achieve and maintain compliance
          with the EU Cyber Resilience Act. Track products, obligations,
          contributors, and vulnerabilities in one place.
        </p>
        <div className="hero-actions">
          <Link to="/signup" className="btn btn-primary btn-lg">Start Free Trial</Link>
          <Link to="/login" className="btn btn-outline btn-lg">Log In</Link>
        </div>
      </section>

      <section className="features">
        <div className="feature-card">
          <h3>Product Classification</h3>
          <p>Classify your software products against CRA categories and track obligation progress.</p>
        </div>
        <div className="feature-card">
          <h3>Contributor Tracking</h3>
          <p>Monitor open-source contributors with automated snapshots and dormancy detection.</p>
        </div>
        <div className="feature-card">
          <h3>Vulnerability Scanning</h3>
          <p>Continuous dependency scanning with CVE alerts and risk scoring.</p>
        </div>
      </section>
    </div>
  );
}
