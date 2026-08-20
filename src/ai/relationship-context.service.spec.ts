import { RelationshipContextService } from './relationship-context.service';

describe('RelationshipContextService', () => {
  let service: RelationshipContextService;

  beforeEach(() => {
    service = new RelationshipContextService();
  });

  it('builds system prompt containing relationship metadata and questionnaire Q&As', () => {
    const prompt = service.buildSystemPrompt({
      name: 'Rahul',
      relationshipType: 'Friendship',
      category: 'Friends',
      answers: [
        {
          questionText: "Where's your friendship at?",
          answer: 'Close, and it feels solid.',
        },
      ],
    });

    expect(prompt).toContain('CLO AI');
    expect(prompt).toContain('Person Name: Rahul');
    expect(prompt).toContain('Relationship Type: Friendship');
    expect(prompt).toContain(
      '- Q: "Where\'s your friendship at?" -> A: "Close, and it feels solid."',
    );
    expect(prompt).not.toContain('relationshipId');
    expect(prompt).not.toContain('userId');
    expect(prompt).not.toContain('questionId');
  });

  it('handles empty questionnaire answers list gracefully', () => {
    const prompt = service.buildSystemPrompt({
      name: 'Priya',
      relationshipType: 'Romantic',
      category: 'Romantic',
    });

    expect(prompt).toContain('Person Name: Priya');
    expect(prompt).toContain('- No prior questionnaire answers recorded yet.');
  });
});
