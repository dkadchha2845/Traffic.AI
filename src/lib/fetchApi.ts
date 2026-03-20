const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
    let lastError = null;

    for (let i = 0; i <= MAX_RETRIES; i++) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    ...options.headers,
                },
            });

            if (!response.ok) {
                // If 5xx, we might want to retry. If 4xx, just throw.
                if (response.status >= 500) {
                    throw new Error(`Server Error: ${response.status}`);
                }
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error: any) {
            lastError = error;
            // Only retry on network errors (fetch failed) or 500s
            const isNetworkError = error.message.includes("Failed to fetch") || error.message.includes("NetworkError");
            const isServerError = error.message.includes("Server Error");

            if (i < MAX_RETRIES && (isNetworkError || isServerError)) {
                console.warn(`[fetchApi] Attempt ${i + 1} failed for ${endpoint}. Retrying in ${RETRY_DELAY}ms...`);
                await delay(RETRY_DELAY);
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}
