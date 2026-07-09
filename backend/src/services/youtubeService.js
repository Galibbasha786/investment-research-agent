import youtubeSearchApi from 'youtube-search-api';

class YouTubeService {
  // Search YouTube videos for a company
  async searchCompanyVideos(symbol, companyName, limit = 10) {
    try {
      const queries = [
        `${companyName} stock analysis`,
        `${symbol} earnings report`,
        `${companyName} financials`,
        `${symbol} investment`,
        `${companyName} news`
      ];

      const allVideos = [];
      
      for (const query of queries) {
        try {
          // Use youtube-search-api which doesn't require an API key
          const response = await youtubeSearchApi.GetListByKeyword(query, false, 3, [{type: 'video'}]);
          
          if (response && response.items) {
            response.items.forEach(item => {
              if (item.id && item.type === 'video') {
                allVideos.push({
                  id: item.id,
                  title: item.title,
                  description: item.description || '',
                  channelTitle: item.channelTitle || '',
                  publishedAt: item.publishedAt || new Date().toISOString(),
                  thumbnail: item.thumbnail?.thumbnails?.[0]?.url || '',
                  channelId: item.channelId || '',
                  url: `https://www.youtube.com/watch?v=${item.id}`
                });
              }
            });
          }
        } catch (error) {
          console.error(`YouTube search error for query "${query}":`, error.message);
        }
      }

      // Deduplicate and return
      const seen = new Set();
      const uniqueVideos = allVideos.filter(v => {
        if (seen.has(v.id)) return false;
        seen.add(v.id);
        return true;
      });

      return uniqueVideos.slice(0, limit);
    } catch (error) {
      console.error('YouTube service error:', error.message);
      return [];
    }
  }

  // Get video details (Fallback if needed, but not heavily used)
  async getVideoDetails(videoId) {
    // Note: With youtube-search-api we get most details during search
    // For more details we would need googleapis with an API key
    return null;
  }

  // Analyze video sentiment using LangChain
  async analyzeVideoContent(videoId, transcript) {
    try {
      if (!transcript) {
        return {
          sentiment: 0,
          keyTopics: [],
          summary: 'No transcript available',
          keyPoints: []
        };
      }

      // Use Gemini for analysis
      const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
      const { HumanMessage, SystemMessage } = await import('@langchain/core/messages');

      const llm = new ChatGoogleGenerativeAI({
        model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
        temperature: 0.2,
        maxOutputTokens: 2048,
        apiKey: process.env.GEMINI_API_KEY
      });

      const prompt = `
Analyze the following video transcript about a company:

Transcript:
${transcript.substring(0, 3000)}

Provide analysis in JSON format:
{
  "sentiment": (score from -1 to 1),
  "keyTopics": ["topic1", "topic2", ...],
  "summary": "brief summary",
  "keyPoints": ["point1", "point2", ...]
}
`;

      const response = await llm.invoke([
        new SystemMessage('You are a financial analyst analyzing video content.'),
        new HumanMessage(prompt)
      ]);

      // Parse JSON response
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : {
          sentiment: 0,
          keyTopics: [],
          summary: 'Unable to parse analysis',
          keyPoints: []
        };
      } catch (parseError) {
        return {
          sentiment: 0,
          keyTopics: [],
          summary: response.content || 'Analysis complete',
          keyPoints: []
        };
      }
    } catch (error) {
      console.error('Video analysis error:', error.message);
      return {
        sentiment: 0,
        keyTopics: [],
        summary: 'Analysis failed',
        keyPoints: []
      };
    }
  }
}

export default new YouTubeService();