-- CreateTable
CREATE TABLE "relationships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_questions" (
    "id" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "relationshipType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationship_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_answers" (
    "id" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationship_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "relationships_userId_idx" ON "relationships"("userId");

-- CreateIndex
CREATE INDEX "relationships_userId_category_idx" ON "relationships"("userId", "category");

-- CreateIndex
CREATE INDEX "relationship_questions_relationshipType_idx" ON "relationship_questions"("relationshipType");

-- CreateIndex
CREATE INDEX "relationship_answers_relationshipId_idx" ON "relationship_answers"("relationshipId");

-- CreateIndex
CREATE INDEX "relationship_answers_questionId_idx" ON "relationship_answers"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "relationship_answers_relationshipId_questionId_key" ON "relationship_answers"("relationshipId", "questionId");

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_answers" ADD CONSTRAINT "relationship_answers_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "relationships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_answers" ADD CONSTRAINT "relationship_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "relationship_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
