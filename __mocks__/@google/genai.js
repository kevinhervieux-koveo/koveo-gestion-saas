const GoogleGenAI = jest.fn().mockImplementation(() => ({
  models: {
    generateContent: jest.fn().mockResolvedValue({
      text: 'mocked response',
    }),
  },
}));

module.exports = {
  GoogleGenAI,
};
