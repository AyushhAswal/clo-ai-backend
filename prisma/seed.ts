import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding RelationshipQuestion templates...');

  const questions = [
    // Friendship
    {
      questionText: "Where's your friendship at?",
      relationshipType: 'Friendship',
    },
    {
      questionText: 'What comes up most strongly around them?',
      relationshipType: 'Friendship',
    },
    {
      questionText: 'What do you most want from this friendship?',
      relationshipType: 'Friendship',
    },

    // Romantic
    {
      questionText: 'Where is your relationship currently?',
      relationshipType: 'Romantic',
    },
    {
      questionText: 'What emotion is most prominent with them?',
      relationshipType: 'Romantic',
    },
    {
      questionText: 'What is your main desire for this relationship?',
      relationshipType: 'Romantic',
    },

    // Professional
    {
      questionText: 'How would you describe your working dynamic?',
      relationshipType: 'Professional',
    },
    {
      questionText: 'What key feeling arises during work with them?',
      relationshipType: 'Professional',
    },
    {
      questionText: 'What outcome do you want in this working dynamic?',
      relationshipType: 'Professional',
    },

    // Family
    {
      questionText: 'How does your connection with this family member feel?',
      relationshipType: 'Family',
    },
    {
      questionText: 'What describes family interactions with them?',
      relationshipType: 'Family',
    },
    {
      questionText: 'What do you hope for in your bond?',
      relationshipType: 'Family',
    },
  ];

  for (const q of questions) {
    const existing = await prisma.relationshipQuestion.findFirst({
      where: {
        questionText: q.questionText,
        relationshipType: q.relationshipType,
      },
    });

    if (!existing) {
      await prisma.relationshipQuestion.create({
        data: q,
      });
    }
  }

  console.log('Successfully seeded RelationshipQuestion templates!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
