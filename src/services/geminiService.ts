import { GoogleGenAI, GenerateContentResponse, Type, Modality } from "@google/genai";
import { ComplaintData, ComplaintResponse } from "../types";

const API_KEY = process.env.GEMINI_API_KEY || "";

const safeParseJSON = (text: string | null | undefined) => {
  if (!text) return {};
  try {
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse JSON response from Gemini:", text);
    throw new Error("Invalid format received from AI.");
  }
};

export const analyzeVideo = async (videoBase64: string, mimeType: string) => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const prompt = `
    You are HAWK, an elite AI Automated Forensics & Investigation System. 
    Analyze this video evidence with extreme precision and professionalism suitable for a court of law or high-level police investigation.
    
    Perform the following tasks:
    1. Preprocessing: Identify resolution and basic video quality in forensic terms.
    2. Visual Analysis: Detect objects (humans, vehicles, bags), track movement, and recognize actions (walking, running, fighting, stealing, etc.).
    3. Behavior Analysis: Identify suspicious patterns (repeated scanning, sudden running, aggressive motions).
    4. Event Extraction: Create a structured timeline of events with timestamps.
    5. Context Understanding: Identify the incident type, suspect(s), victim(s), and witnesses.
    6. Dynamic Q&A: Generate 4-5 investigation questions based on the specific context of this video.
    7. Confidence Scoring: Provide a suspicion score and overall confidence level.

    Return the analysis in the following JSON structure:
    {
      "caseType": "Theft | Accident | Harassment | Suspicious Activity | Normal",
      "summary": "Brief scene summary",
      "timeline": [
        { "time": "MM:SS", "event": "Description of event", "confidence": 0.0-1.0 }
      ],
      "entities": {
        "suspects": ["Description of suspect(s)"],
        "victims": ["Description of victim(s)"],
        "witnesses": ["Description of witness(es)"]
      },
      "observations": ["Key forensic behavior observations and factual notes"],
      "dynamicQA": [
        { "question": "Professional investigative query", "answer": "Factual answer based firmly on evidence" }
      ],
      "factStory": "A highly formal, objective incident narrative written in official police report format, detailing the sequence of events without assumption.",
      "conclusion": "Final conclusive analysis",
      "scores": {
        "suspicion": 0.0-1.0,
        "riskLevel": "LOW | MEDIUM | HIGH",
        "confidence": 0.0-1.0
      }
    }
  `;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: videoBase64,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  return safeParseJSON(response.text);
};

export const askEvidenceQuestion = async (report: any, question: string) => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const prompt = `
    You are HAWK, a highly professional AI Forensics Assistant.
    You have analyzed some video evidence and generated the following official forensic report:
    ${JSON.stringify(report, null, 2)}
    
    The investigating officer has asked the following exact question regarding this evidence:
    "${question}"
    
    Answer the question strictly based on the extracted evidence data above. Maintain a highly professional, objective, and analytical tone suitable for law enforcement officials.
    If the answer is not present in the evidence data, state clearly that the current evidence does not contain this information and refrain from guessing or hallucinating.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ parts: [{ text: prompt }] }]
  });

  return response.text;
};

export const extractIdDetails = async (imageBase64: string, mimeType: string) => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const prompt = `
    Analyze this Government ID card (Aadhar, PAN, Voter ID, Driver's License, etc.).
    Extract the following information:
    1. Full Name
    2. Address (if available)
    3. ID Number (e.g., Aadhar number, PAN number)
    
    Return the information in the following JSON structure:
    {
      "fullName": "Extracted Name",
      "address": "Extracted Address",
      "idProof": "ID Type and Number"
    }
    
    If any field is not found, return an empty string for that field.
  `;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  return safeParseJSON(response.text);
};

export const analyzeLiveFrame = async (imageBase64: string) => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const prompt = `
    Analyze this single frame from a live security camera.
    Perform:
    1. Face Detection & Tracking: Identify any person in view.
    2. Emotion Recognition: Detect the primary emotion (e.g., Calm, Angry, Nervous, Happy).
    3. Body Language Analysis: Describe posture and gestures.
    4. Behavior Pattern Detection: Identify any suspicious or notable patterns.
    5. Intent Inference: Infer the likely intent of the person.
    6. Risk Scoring: Assign a risk level (LOW, MEDIUM, HIGH).

    Return JSON:
    {
      "emotion": "Emotion name",
      "bodyLanguage": "Description",
      "behaviorPattern": "Description",
      "intentInference": "Inferred intent",
      "riskScore": "LOW | MEDIUM | HIGH",
      "confidence": 0.0-1.0
    }
  `;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBase64,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  return safeParseJSON(response.text);
};

export const analyzeCrowd = async (imageBase64: string) => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const prompt = `
    Analyze this image for advanced crowd management, detection, and behavior analysis.
    
    1. Crowd Detection:
       - Estimate the total number of people (People Count).
       - Determine Crowd Density (Low, Medium, High, Critical).
       - Identify Movement Patterns and flow direction.
       - Identify regions of high density (for Heatmap description).
       - Note if faces are detectable or trackable.

    2. Crowd Behavior Analysis:
       - Detect Normal vs Abnormal behavior.
       - Check for Panic signs (running, sudden movements, turbulence).
       - Identify Group Formations (clusters of people).
       - Analyze overall Crowd Emotion (e.g., Calm, Excited, Agitated, Fearful).

    3. Crowd Management Strategies (AI generated actionable plan):
       - Flow Control & Queuing: Strategies to form smooth lines and organize the traffic.
       - Crowd Clearing: Exact step-by-step methods to clear the crowd safely and rapidly.
       - Alert Systems: Determine if an immediate authority notification is needed.
       - Resource Allocation: Suggest how many officers/security personnel should be deployed.
       - Emergency Handling: Provide a brief evacuation plan or route optimization suggestion.
       - Actionable Plan: A structured, step-by-step AI strategy plan to manage, align, and clear this specific crowd.

    Return the analysis in the following JSON structure:
    {
      "detection": {
        "count": number,
        "density": "Low | Medium | High | Critical",
        "movement": "Description of flow and patterns",
        "heatmapAreas": ["Description of high-density zones"],
        "trackingStatus": "Description of face/object tracking feasibility"
      },
      "behavior": {
        "status": "Normal | Abnormal",
        "panicDetected": boolean,
        "groupFormations": "Description of clusters",
        "emotion": "Dominant crowd emotion",
        "anomalyDetails": ["Specific unusual behaviors found"]
      },
      "management": {
        "flowControl": "Suggested regulations for forming smooth lines",
        "crowdClearing": "Methods to safely clear the crowd",
        "alertNeeded": boolean,
        "alertReason": "Why an alert is or isn't needed",
        "resourceDeployment": "Security personnel recommendation",
        "emergencyPlan": "Evacuation/Route optimization advice",
        "actionablePlan": ["Step 1: ...", "Step 2: ...", "Step 3: ..."]
      },
      "safetyScore": 0.0-1.0
    }
  `;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBase64,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  return safeParseJSON(response.text);
};

export const generateSpeech = async (text: string, voice: 'Male' | 'Female' | 'Child') => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const voiceMap = {
    'Male': 'Fenrir',
    'Female': 'Kore',
    'Child': 'Puck'
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceMap[voice] },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

export const processComplaintTurn = async (
  history: { role: 'user' | 'model', text: string }[],
  currentData: ComplaintData,
  language: string = "English",
  userAudioBase64?: string
): Promise<ComplaintResponse> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const systemInstruction = `
    You are a helpful AI Assistant for HAWK, specialized in registering formal police complaints.
    Your goal is to collect all necessary information from the user through a natural, empathetic conversation.
    
    LANGUAGE PREFERENCE: ${language}
    - If the language is a mix, you should understand both and respond in a natural mix.
    - If the language is Hindi or Telugu, respond primarily in that language but keep technical terms in English.
    
    REQUIRED INFORMATION DATA STRUCTURE:
    {
      "basicInfo": { "fullName": "", "address": "", "contact": "", "idProof": "" },
      "incidentDetails": { "dateTime": "", "location": "", "type": "", "description": "" },
      "accusedDetails": { "name": "", "phone": "", "identifyingDetails": "" },
      "witnessDetails": { "names": "", "contact": "", "whatTheySaw": "" },
      "propertyDetails": { "stolenOrDamagedItems": "", "estimatedValue": "", "serialNumbers": "" }
    }

    STRICT GUIDELINES:
    1. NEVER GUESS OR INVENT DATA. Do not use dummy data, placeholders (like "TBD", "N/A", "Unknown", or fake names). Only fill a field if the user EXPLICITLY provided it.
    2. ASK EXACTLY ONE QUESTION AT A TIME. Wait for the user's answer before asking the next question. Do not ask for multiple pieces of information at once.
    3. Be conversational and empathetic.
    4. You must return the FULL, updated data object in "extractedData", merging what you already have with the new information extracted from the user's latest message.

    CURRENT COLLECTED DATA: ${JSON.stringify(currentData)}
    
    RESPONSE FORMAT (JSON):
    {
      "nextQuestion": "The next single question to ask the user in ${language}.",
      "extractedData": { 
         "basicInfo": { ... },
         "incidentDetails": { ... },
         "accusedDetails": { ... },
         "witnessDetails": { ... },
         "propertyDetails": { ... }
       },
      "isComplete": false (Set to true ONLY when all required fields are filled),
      "formalComplaint": "The full formal complaint text (only if isComplete is true, otherwise null)"
    }
  `;

  const parts: any[] = [{ text: systemInstruction }];
  
  // Add history
  history.forEach(h => {
    parts.push({ text: `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}` });
  });

  if (userAudioBase64) {
    parts.push({
      inlineData: {
        mimeType: "audio/webm",
        data: userAudioBase64
      }
    });
    parts.push({ text: "The user just spoke the above audio. Transcribe it and extract information." });
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ parts }],
    config: {
      responseMimeType: "application/json",
    },
  });

  return safeParseJSON(response.text);
};
