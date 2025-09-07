/**
 * Mock for @google/genai package to avoid ES module import issues in Jest
 */

// Mock the GoogleGenAI class
class MockGoogleGenAI {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  getGenerativeModel(modelConfig) {
    return {
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => 'Mock AI response'
        }
      }),
      generateContentStream: jest.fn().mockResolvedValue({
        stream: []
      })
    };
  }
}

// Mock all the exports from @google/genai
const mockGoogleGenAI = {
  GoogleGenAI: MockGoogleGenAI,
  HarmCategory: {
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'SEXUALLY_EXPLICIT',
    HARM_CATEGORY_HATE_SPEECH: 'HATE_SPEECH',
    HARM_CATEGORY_HARASSMENT: 'HARASSMENT',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'DANGEROUS_CONTENT'
  },
  HarmBlockThreshold: {
    BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE',
    BLOCK_LOW_AND_ABOVE: 'BLOCK_LOW_AND_ABOVE',
    BLOCK_ONLY_HIGH: 'BLOCK_ONLY_HIGH',
    BLOCK_NONE: 'BLOCK_NONE'
  }
};

module.exports = mockGoogleGenAI;