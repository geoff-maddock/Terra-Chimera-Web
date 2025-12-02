
import { GoogleGenAI, Type } from "@google/genai";
import { BiomeType, ElementType, Monster, Stats, Anatomy } from "../types";

export const generateMonsterLore = async (
  element: ElementType,
  baseStats: Stats
): Promise<{ name: string; description: string; traits: string[]; anatomy: Anatomy }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      Generate a unique, creative name, a short 2-sentence description, 2 special traits (short 1-2 word tags), 
      and a physical body chart (trunk type, head type, and 1-2 appendage types) for a sci-fi/fantasy monster in a game called TerraChimera.
      
      Context:
      Element: ${element}
      Stats: High ${Object.entries(baseStats).reduce((a, b) => a[1] > b[1] ? a : b)[0]}
      
      The anatomy should reflect the element (e.g., Aero might have wings, Hydro might have fins).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            traits: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            anatomy: {
                type: Type.OBJECT,
                properties: {
                    trunk: { type: Type.STRING },
                    head: { type: Type.STRING },
                    appendages: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: ["trunk", "head", "appendages"]
            }
          },
          required: ["name", "description", "traits", "anatomy"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      name: `${element} Specimen`,
      description: "A mysterious creature synthesized from raw biomass. Genetic sequencing incomplete.",
      traits: ["Unstable", "Synthesized"],
      anatomy: {
          trunk: "Amorphous",
          head: "Featureless",
          appendages: ["Tentacles"]
      }
    };
  }
};

export const generateBattleReport = async (
  attacker: Monster,
  defender: Monster,
  winnerName: string
): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const prompt = `
            Write a short, thrilling 2-sentence battle narration between two monsters.
            Attacker: ${attacker.name} (${attacker.element}, ${attacker.anatomy.trunk} body with ${attacker.anatomy.appendages.join(', ')})
            Defender: ${defender.name} (${defender.element}, ${defender.anatomy.trunk} body)
            Result: ${winnerName} wins dramatically.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text || "The battle concludes swiftly.";
    } catch (error) {
        console.error("Gemini Error:", error);
        return "The dust settles after a fierce clash.";
    }
}

export const generateExplorationEvent = async (faction: string, biomes: BiomeType[]): Promise<{ message: string, rewardType: 'credits' | 'biomass' | 'mana' | 'none', amount: number }> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const prompt = `
            Generate a very short (1 sentence) exploration event for the faction ${faction} on an alien planet in a ${biomes.join(' and ')} biome.
            Determine a small resource reward (Credits, Biomass, Mana, or None) and an amount (20-150).
            The message should be atmospheric sci-fi.
        `;

        const response = await ai.models.generateContent({
             model: "gemini-2.5-flash",
             contents: prompt,
             config: {
                 responseMimeType: "application/json",
                 responseSchema: {
                     type: Type.OBJECT,
                     properties: {
                         message: { type: Type.STRING },
                         rewardType: { type: Type.STRING, enum: ['credits', 'biomass', 'mana', 'none'] },
                         amount: { type: Type.NUMBER }
                     }
                 }
             }
        });
         const text = response.text;
         if(!text) throw new Error("No text");
         return JSON.parse(text);
    } catch (e) {
        console.error("Gemini Error:", e);
        return { message: "Sensors picked up interference. Data inconclusive.", rewardType: 'none', amount: 0 };
    }
}
