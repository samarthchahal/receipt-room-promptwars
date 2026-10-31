import { RawTransaction, Category, CATEGORIES } from '../../shared/types';

/** Keyword-based category suggestion engine — no AI required */
const CATEGORY_RULES: Array<{ keywords: string[]; category: Category }> = [
  {
    keywords: ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'sushi', 'diner', 'bakery',
      'starbucks', 'mcdonalds', 'subway', 'chipotle', 'dominos', 'grubhub', 'doordash',
      'ubereats', 'uber eats', 'zomato', 'swiggy', 'food', 'dining', 'lunch', 'dinner',
      'breakfast', 'brunch', 'taco', 'noodle', 'thai', 'chinese', 'indian', 'italian',
      'kitchen', 'grill', 'bistro', 'pub', 'bar', 'drinks', 'smoothie', 'juice'],
    category: 'Food & Dining',
  },
  {
    keywords: ['amazon', 'walmart', 'target', 'costco', 'ebay', 'etsy', 'shop', 'store',
      'mall', 'outlet', 'retail', 'clothing', 'apparel', 'shoes', 'fashion', 'ikea',
      'home depot', 'lowes', 'best buy', 'apple store', 'nike', 'adidas', 'zara',
      'h&m', 'gap', 'old navy', 'nordstrom', 'macys', 'purchase', 'order', 'buy',
      'flipkart', 'myntra', 'ajio'],
    category: 'Shopping',
  },
  {
    keywords: ['uber', 'lyft', 'taxi', 'cab', 'gas', 'fuel', 'petrol', 'diesel', 'shell',
      'chevron', 'exxon', 'bp', 'parking', 'toll', 'metro', 'subway', 'bus', 'train',
      'airline', 'flight', 'airfare', 'delta', 'united', 'american airlines', 'southwest',
      'transit', 'transport', 'ola', 'rapido', 'auto', 'rickshaw', 'indigo', 'spicejet'],
    category: 'Transport',
  },
  {
    keywords: ['electric', 'electricity', 'water', 'gas bill', 'internet', 'wifi', 'broadband',
      'phone bill', 'mobile', 'verizon', 'at&t', 'tmobile', 't-mobile', 'comcast', 'spectrum',
      'utility', 'utilities', 'rent', 'mortgage', 'insurance', 'tax', 'property',
      'maintenance', 'hoa', 'cable', 'sewer', 'trash', 'waste', 'jio', 'airtel', 'bsnl',
      'vodafone', 'vi mobile', 'act fibernet', 'tata power', 'bescom'],
    category: 'Bills & Utilities',
  },
  {
    keywords: ['netflix', 'spotify', 'hulu', 'disney', 'hbo', 'youtube', 'twitch', 'game',
      'gaming', 'steam', 'playstation', 'xbox', 'nintendo', 'cinema', 'movie', 'theater',
      'theatre', 'concert', 'ticket', 'amc', 'regal', 'entertainment', 'music', 'show',
      'event', 'festival', 'amusement', 'park', 'zoo', 'museum', 'prime video', 'hotstar',
      'jiocinema', 'bookmyshow'],
    category: 'Entertainment',
  },
  {
    keywords: ['pharmacy', 'cvs', 'walgreens', 'hospital', 'doctor', 'dentist', 'medical',
      'health', 'clinic', 'lab', 'prescription', 'medicine', 'drug', 'therapy', 'wellness',
      'gym', 'fitness', 'yoga', 'vitamin', 'supplement', 'optical', 'eye', 'dental',
      'apollo', 'practo', 'pharmeasy', '1mg', 'netmeds', 'medplus'],
    category: 'Health',
  },
  {
    keywords: ['university', 'college', 'school', 'tuition', 'course', 'udemy', 'coursera',
      'education', 'book', 'textbook', 'library', 'seminar', 'workshop', 'training',
      'certification', 'exam', 'tutorial', 'learning', 'academy', 'class', 'lecture',
      'unacademy', 'byju', 'upgrad', 'simplilearn', 'skillshare'],
    category: 'Education',
  },
];

export function suggestCategory(description: string): Category {
  const lower = description.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword)) {
        return rule.category;
      }
    }
  }

  return 'Other';
}

export function isValidCategory(cat: string): cat is Category {
  return CATEGORIES.includes(cat as Category);
}
