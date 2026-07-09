import axios from 'axios';
import Parser from 'rss-parser';

class NewsService {
  constructor() {
    this.parser = new Parser();
    this.newsApiKey = process.env.NEWS_API_KEY;
    this.finnhubKey = process.env.FINNHUB_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
  }

  // Fetch news from multiple sources
  async fetchCompanyNews(symbol, limit = 20) {
    try {
      const [finnhubNews, newsApiNews, rssNews] = await Promise.all([
        this.fetchFinnhubNews(symbol),
        this.fetchNewsApiNews(symbol),
        this.fetchRSSNews(symbol)
      ]);

      const allNews = [...finnhubNews, ...newsApiNews, ...rssNews];
      const uniqueNews = this.deduplicateNews(allNews);
      
      return uniqueNews.slice(0, limit);
    } catch (error) {
      console.error('News fetch error:', error.message);
      return [];
    }
  }

  // Fetch from Finnhub
  async fetchFinnhubNews(symbol) {
    try {
      if (!this.finnhubKey) return [];

      const response = await axios.get('https://finnhub.io/api/v1/company-news', {
        params: {
          symbol: symbol,
          from: this.getDateString(-7),
          to: this.getDateString(0),
          token: this.finnhubKey
        }
      });

      return response.data.map(item => ({
        id: `finnhub_${item.id}`,
        title: item.headline || item.title || 'No title',
        summary: item.summary || 'No summary available',
        source: item.source || 'Finnhub',
        url: item.url || '#',
        publishedAt: new Date(item.datetime * 1000).toISOString(),
        sentiment: this.calculateSentiment(item.headline || ''),
        relevance: item.relevance || 0.5,
        imageUrl: item.image || null
      }));
    } catch (error) {
      console.error('Finnhub news error:', error.message);
      return [];
    }
  }

  // Fetch from News API
  async fetchNewsApiNews(symbol) {
    try {
      if (!this.newsApiKey) return [];

      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: symbol,
          language: 'en',
          sortBy: 'relevancy',
          pageSize: 20,
          apiKey: this.newsApiKey
        }
      });

      return response.data.articles.map(item => ({
        id: `newsapi_${item.url}`,
        title: item.title || 'No title',
        summary: item.description || item.content || 'No summary available',
        source: item.source?.name || 'NewsAPI',
        url: item.url || '#',
        publishedAt: item.publishedAt || new Date().toISOString(),
        sentiment: this.calculateSentiment(item.title || ''),
        relevance: 0.5,
        imageUrl: item.urlToImage || null
      }));
    } catch (error) {
      console.error('NewsAPI error:', error.message);
      return [];
    }
  }

  // Fetch from RSS feeds
  async fetchRSSNews(symbol) {
    try {
      const feeds = [
        'https://feeds.bloomberg.com/markets/news.rss',
        'https://www.ft.com/?format=rss',
        'https://feeds.marketwatch.com/marketwatch/topstories'
      ];

      const results = [];
      for (const feedUrl of feeds) {
        try {
          const feed = await this.parser.parseURL(feedUrl);
          const items = feed.items.slice(0, 5);
          
          items.forEach(item => {
            if (item.title?.toLowerCase().includes(symbol.toLowerCase()) ||
                item.contentSnippet?.toLowerCase().includes(symbol.toLowerCase())) {
              results.push({
                id: `rss_${item.guid || item.link}`,
                title: item.title || 'No title',
                summary: item.contentSnippet || item.content || 'No summary available',
                source: feed.title || 'RSS Feed',
                url: item.link || '#',
                publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
                sentiment: this.calculateSentiment(item.title || ''),
                relevance: 0.4,
                imageUrl: null
              });
            }
          });
        } catch (error) {
          console.error('RSS feed error:', error.message);
        }
      }
      
      return results;
    } catch (error) {
      console.error('RSS fetch error:', error.message);
      return [];
    }
  }

  calculateSentiment(text) {
    const positiveWords = ['up', 'rise', 'gain', 'profit', 'growth', 'success', 'positive', 'beat', 'exceed', 'record', 'high', 'bullish', 'rally', 'surge', 'jump', 'soar', 'boost', 'strong'];
    const negativeWords = ['down', 'fall', 'loss', 'decline', 'risk', 'negative', 'miss', 'low', 'bearish', 'crash', 'drop', 'slump', 'warning', 'plunge', 'tumble', 'slip', 'weak', 'concern'];
    
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    let count = 0;
    
    words.forEach(word => {
      if (positiveWords.some(pw => word.includes(pw))) {
        score += 0.1;
        count++;
      }
      if (negativeWords.some(nw => word.includes(nw))) {
        score -= 0.1;
        count++;
      }
    });
    
    return count > 0 ? Math.max(-1, Math.min(1, score)) : 0;
  }

  getDateString(daysOffset) {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0];
  }

  deduplicateNews(news) {
    const seen = new Set();
    return news.filter(item => {
      const key = item.title?.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async getNewsSentiment(symbol) {
    try {
      const news = await this.fetchCompanyNews(symbol, 30);
      
      if (news.length === 0) {
        return {
          symbol,
          overallSentiment: 0,
          sentimentScore: 50,
          bullCount: 0,
          bearCount: 0,
          neutralCount: 0,
          totalNews: 0,
          topPositive: [],
          topNegative: []
        };
      }

      const sentiments = news.map(n => n.sentiment);
      const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
      
      const positive = news.filter(n => n.sentiment > 0.1);
      const negative = news.filter(n => n.sentiment < -0.1);
      const neutral = news.filter(n => n.sentiment >= -0.1 && n.sentiment <= 0.1);

      const sortedBySentiment = [...news].sort((a, b) => b.sentiment - a.sentiment);

      return {
        symbol,
        overallSentiment: avgSentiment || 0,
        sentimentScore: Math.round((avgSentiment + 1) * 50) || 50,
        bullCount: positive.length,
        bearCount: negative.length,
        neutralCount: neutral.length,
        totalNews: news.length,
        topPositive: sortedBySentiment.slice(0, 3).filter(n => n.sentiment > 0),
        topNegative: sortedBySentiment.slice(-3).filter(n => n.sentiment < 0)
      };
    } catch (error) {
      console.error('Sentiment analysis error:', error.message);
      return {
        symbol,
        overallSentiment: 0,
        sentimentScore: 50,
        bullCount: 0,
        bearCount: 0,
        neutralCount: 0,
        totalNews: 0,
        topPositive: [],
        topNegative: []
      };
    }
  }
}

export default new NewsService();