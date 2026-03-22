import { supabase } from "@/integrations/supabase/client";
import { API_BASE_URL } from "./runtimeConfig";

const AGENT_API_BASE_URL = `${API_BASE_URL}/api`;

/**
 * Helper utility to get the current Supabase session token.
 * This token is required to authenticate requests to the Python backend.
 */
export async function getAuthToken(): Promise<string | null> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        console.warn("Could not retrieve Supabase session token", error);
        return null;
    }
    return session.access_token;
}

/**
 * Example function to chat with the new Python RAG Agent.
 * It automatically attaches the Supabase JWT.
 */
export async function askRagAgent(query: string) {
    const token = await getAuthToken();
    if (!token) {
        throw new Error("You must be logged in to use the AI Agent.");
    }

    // The backend expects `query` as a query parameter (defined as query: str in FastAPI)
    const response = await fetch(`${AGENT_API_BASE_URL}/rag/chat?query=${encodeURIComponent(query)}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to communicate with the Agent Backend");
    }

    return response.json();
}
