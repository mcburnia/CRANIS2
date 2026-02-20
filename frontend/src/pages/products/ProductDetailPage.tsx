import { useParams } from "react-router-dom";
import PageHeader from "../../components/PageHeader";

export default function ProductDetailPage() {
  const { productId } = useParams();
  return (
    <>
      <PageHeader title={`Product: ${productId}`} />
      <p style={{ color: "var(--muted)" }}>Product detail page will be migrated here.</p>
    </>
  );
}
