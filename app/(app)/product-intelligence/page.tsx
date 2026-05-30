import { ProductIntelligence } from "@/components/intelligence/product-intelligence";
import { getProductIntelligence } from "@/lib/data";

export default async function ProductIntelligencePage() {
  const rows = await getProductIntelligence();
  return <ProductIntelligence rows={rows} />;
}
