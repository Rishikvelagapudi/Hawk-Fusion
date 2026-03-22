export interface TimelineEvent {
  time: string;
  event: string;
  confidence: number;
}

export interface DynamicQA {
  question: string;
  answer: string;
}

export interface EmotionalAnalysis {
  emotion: string;
  bodyLanguage: string;
  behaviorPattern: string;
  intentInference: string;
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
}

export interface ComplaintData {
  basicInfo: {
    fullName?: string;
    address?: string;
    contact?: string;
    idProof?: string;
  };
  incidentDetails: {
    dateTime?: string;
    location?: string;
    type?: string;
    description?: string;
  };
  accusedDetails: {
    name?: string;
    address?: string;
    phone?: string;
    details?: string;
  };
  witnessDetails: {
    names?: string;
    contact?: string;
    observations?: string;
  };
  propertyDetails: {
    items?: string;
    value?: string;
    serialNumbers?: string;
  };
}

export interface ComplaintResponse {
  nextQuestion: string;
  extractedData: Partial<ComplaintData>;
  isComplete: boolean;
  formalComplaint?: string;
}

export interface InvestigationReport {
  caseType: string;
  summary: string;
  timeline: TimelineEvent[];
  entities: {
    suspects: string[];
    victims: string[];
    witnesses: string[];
  };
  observations: string[];
  dynamicQA: DynamicQA[];
  factStory: string;
  conclusion: string;
  scores: {
    suspicion: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    confidence: number;
  };
}
