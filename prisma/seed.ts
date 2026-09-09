import "dotenv/config";
import { prisma } from "../services/database";
import { demoLocations } from "../services/locations";
async function main() {
  for (const location of demoLocations)
    await prisma.demoLocation.upsert({
      where: { id: location.id },
      update: location,
      create: location,
    });
  console.log(`Seeded ${demoLocations.length} demo locations`);
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
