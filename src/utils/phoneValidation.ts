// Phone number validation utilities

interface ValidationResult {
  isValid: boolean;
  formatted: string;
  errorMessage?: string;
}

// Common country codes and their expected formats
const countryPatterns: Record<string, { code: string; minLength: number; maxLength: number }> = {
  '55': { code: 'BR', minLength: 10, maxLength: 11 }, // Brazil
  '1': { code: 'US', minLength: 10, maxLength: 10 }, // USA/Canada
  '44': { code: 'UK', minLength: 10, maxLength: 10 }, // UK
  '351': { code: 'PT', minLength: 9, maxLength: 9 }, // Portugal
  '34': { code: 'ES', minLength: 9, maxLength: 9 }, // Spain
  '49': { code: 'DE', minLength: 10, maxLength: 11 }, // Germany
  '33': { code: 'FR', minLength: 9, maxLength: 9 }, // France
  '39': { code: 'IT', minLength: 9, maxLength: 10 }, // Italy
  '54': { code: 'AR', minLength: 10, maxLength: 10 }, // Argentina
  '56': { code: 'CL', minLength: 9, maxLength: 9 }, // Chile
  '57': { code: 'CO', minLength: 10, maxLength: 10 }, // Colombia
  '52': { code: 'MX', minLength: 10, maxLength: 10 }, // Mexico
};

export function validatePhoneNumber(phone: string): ValidationResult {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  if (!cleaned) {
    return {
      isValid: false,
      formatted: phone,
      errorMessage: 'Número vazio',
    };
  }

  if (cleaned.length < 8) {
    return {
      isValid: false,
      formatted: phone,
      errorMessage: 'Número muito curto',
    };
  }

  if (cleaned.length > 15) {
    return {
      isValid: false,
      formatted: phone,
      errorMessage: 'Número muito longo',
    };
  }

  // Try to identify country code
  let countryCode = '';
  let localNumber = cleaned;

  // Check for known country codes (longest first)
  for (const code of Object.keys(countryPatterns).sort((a, b) => b.length - a.length)) {
    if (cleaned.startsWith(code)) {
      countryCode = code;
      localNumber = cleaned.slice(code.length);
      break;
    }
  }

  // If no country code found, assume Brazil (+55)
  if (!countryCode) {
    // Check if it's a valid Brazilian number without country code
    if (cleaned.length >= 10 && cleaned.length <= 11) {
      countryCode = '55';
      localNumber = cleaned;
    } else {
      return {
        isValid: false,
        formatted: phone,
        errorMessage: 'Código de país não identificado',
      };
    }
  }

  const pattern = countryPatterns[countryCode];
  
  if (pattern) {
    if (localNumber.length < pattern.minLength) {
      return {
        isValid: false,
        formatted: phone,
        errorMessage: `Número muito curto para ${pattern.code}`,
      };
    }
    if (localNumber.length > pattern.maxLength) {
      return {
        isValid: false,
        formatted: phone,
        errorMessage: `Número muito longo para ${pattern.code}`,
      };
    }
  }

  // Format the number
  const formatted = `+${countryCode} ${formatLocalNumber(localNumber, countryCode)}`;

  return {
    isValid: true,
    formatted,
  };
}

function formatLocalNumber(number: string, countryCode: string): string {
  if (countryCode === '55') {
    // Brazilian format: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
    if (number.length === 11) {
      return `(${number.slice(0, 2)}) ${number.slice(2, 7)}-${number.slice(7)}`;
    } else if (number.length === 10) {
      return `(${number.slice(0, 2)}) ${number.slice(2, 6)}-${number.slice(6)}`;
    }
  }
  
  // Generic formatting for other countries
  if (number.length > 6) {
    return `${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6)}`;
  }
  
  return number;
}

export function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

export function detectDelimiter(text: string): string {
  const firstLine = text.split('\n')[0];
  const delimiters = [',', ';', '\t', '|'];
  
  let maxCount = 0;
  let detectedDelimiter = ',';
  
  for (const delimiter of delimiters) {
    const count = (firstLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      detectedDelimiter = delimiter;
    }
  }
  
  return detectedDelimiter;
}
