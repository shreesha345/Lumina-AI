export interface UserProfile {
    preferred_visual_type?: string;
    learning_style?: string;
    hobbies?: string[];
    interests?: string[];
    skill_level?: string;
    preferred_examples?: string;
    [key: string]: any;
}

export const readMemory = async (): Promise<UserProfile | null> => {
    try {
        const res = await fetch('/api/memory');
        if (!res.ok) {
            if (res.status === 404) return null;
            throw new Error('Failed to read memory');
        }
        return await res.json();
    } catch (error) {
        console.error("Error reading memory:", error);
        return null;
    }
};

export const writeMemory = async (profile: UserProfile): Promise<boolean> => {
    try {
        const res = await fetch('/api/memory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profile)
        });
        return res.ok;
    } catch (error) {
        console.error("Error writing memory:", error);
        return false;
    }
};

export const updateMemory = async (partialProfile: Partial<UserProfile>): Promise<boolean> => {
    try {
        const current = await readMemory() || {};
        const updated = { ...current, ...partialProfile };
        return await writeMemory(updated);
    } catch (error) {
        console.error("Error updating memory:", error);
        return false;
    }
};
