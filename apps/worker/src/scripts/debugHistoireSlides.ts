import { igQueueRepo } from "@edlight-news/firebase";

function slideText(slide: { heading: string; bullets: string[] }): string {
  return [slide.heading, ...slide.bullets].join(" ").trim();
}
function similarity(a: string, b: string): number {
  const setA = new Set(a.split(/\s+/));
  const setB = new Set(b.split(/\s+/));
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

async function main() {
  const item = await igQueueRepo.getIGQueueItem("b1fKQKNkwCnCRQNu8cFW");
  if (!item?.payload) return;

  item.payload.slides.forEach((s, i) => {
    console.log(`\n=== Slide ${i} ===`);
    console.log("heading:", s.heading);
    console.log("bullets:", s.bullets);
    console.log("slideText:", slideText(s));
  });

  console.log("\n=== SIMILARITY MATRIX ===");
  const slides = item.payload.slides;
  for (let i = 0; i < slides.length; i++) {
    for (let j = i+1; j < slides.length; j++) {
      const s = similarity(slideText(slides[i]!), slideText(slides[j]!));
      console.log(`Slides ${i+1} vs ${j+1}: ${s.toFixed(3)} ${s >= 0.72 ? '⚠️ TOO SIMILAR' : ''}`);
    }
  }
}
main().catch(console.error);
