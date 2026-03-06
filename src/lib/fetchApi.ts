const API_BASE = "http://localhost:8000";

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("fetchApi error:", error);
        throw error;
    }
}
