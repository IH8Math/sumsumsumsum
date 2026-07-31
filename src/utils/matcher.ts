export const normalizeText = (text: string) => text.replace(/\s+/g, '').toLowerCase();

const trainingCategories = [
  {
    id: 'violence',
    keywords: ['폭력', '성희롱', '성매매', '성폭력', '가정폭력', '4대폭력']
  },
  {
    id: 'gambling',
    keywords: ['도박']
  },
  {
    id: 'integrity',
    keywords: ['청렴', '부패', '갑질']
  },
  {
    id: 'safety',
    keywords: ['안전', '보건', '중대재해']
  },
  {
    id: 'cpr',
    keywords: ['심폐소생술', '응급처치', 'cpr']
  },
  {
    id: 'child_abuse',
    keywords: ['아동학대', '신고의무자', '아동복지']
  },
  {
    id: 'disability',
    keywords: ['장애인', '인식개선']
  },
  {
    id: 'information_security',
    keywords: ['정보보안', '개인정보']
  },
  {
    id: 'suicide',
    keywords: ['생명존중', '자살예방']
  }
];

export const isTrainingMatched = (completedCourseName: string, requiredCourseName: string) => {
  if (!completedCourseName || !requiredCourseName) return false;
  
  const normCompleted = normalizeText(completedCourseName);
  const normRequired = normalizeText(requiredCourseName);
  
  // 1. Direct inclusion
  if (normCompleted.includes(normRequired) || normRequired.includes(normCompleted)) {
    return true;
  }
  
  // 2. Check for "꾸러미" or "통합" or "패키지"
  const isBundle = ['꾸러미', '통합', '패키지', '법정의무'].some(word => normCompleted.includes(word));
  
  // 3. Category matching
  for (const category of trainingCategories) {
    const requiredHasCategory = category.keywords.some(kw => normRequired.includes(kw));
    
    if (requiredHasCategory) {
      // If the completed course is a broad bundle, it covers the standard categories
      if (isBundle) return true;
      
      const completedHasCategory = category.keywords.some(kw => normCompleted.includes(kw));
      if (completedHasCategory) return true;
    }
  }
  
  return false;
};
