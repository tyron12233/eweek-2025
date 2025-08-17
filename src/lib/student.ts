// Utilities to fetch student info and parse a display name from email

export interface RawStudentResponse {
    count: number;
    regkey: number;
    whitelist: string | number | boolean;
    card_tag: number;
    partner_id: string; // student id
    email_address: string;
    department: string;
    guest_fullname: string;
    reg_guest: string | number | boolean;
    member: unknown[];
}

export interface StudentInfo {
    id: string;
    email: string;
    name: string; // Parsed from email: firstname_secondname_lastname@dlsl.edu.ph -> "Firstname Secondname Lastname"
    department?: string;
    whitelist?: boolean;
    raw: RawStudentResponse;
}

/**
 * Capitalize each word, handling hyphenated names as well (e.g., "mary-jane" -> "Mary-Jane").
 */
function capitalizeWord(word: string): string {
    return word
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join('-');
}

/**
 * Parse a name from an email with the format: firstname_secondname_lastname@dlsl.edu.ph
 * - Uses underscores as word separators, hyphens are preserved within a word.
 * - Any number of underscore-separated parts are supported and joined with spaces.
 */
export function parseNameFromEmail(email: string): string {
    if (!email) return '';
    const [localPart] = email.split('@');
    if (!localPart) return '';

    const parts = localPart.split('_').filter(Boolean);
    if (parts.length === 0) return '';

    return parts.map(capitalizeWord).join(' ');
}

/**
 * Fetch student info by ID from the DLSL student API and return a normalized object.
 * Returns null on error.
 */
export async function fetchStudentInfo(id: string): Promise<StudentInfo | null> {
    if (!id) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
        const url = `https://dlsl-student-api.onrender.com/api/student?id=${encodeURIComponent(id)}`;
        const res = await fetch(url, {
            method: 'GET',
            // Note: standard fetch cache options in browsers differ from Next.js server fetch.
            // Leaving default caching; adjust if needed for your use-case.
            signal: controller.signal,
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch student (${res.status} ${res.statusText})`);
        }

        const data = (await res.json()) as RawStudentResponse;

        const email = data.email_address ?? '';
        const name = parseNameFromEmail(email);
        const whitelist = `${data.whitelist}` === '1' || `${data.whitelist}`.toLowerCase() === 'true';

        const normalized: StudentInfo = {
            id: data.partner_id || id,
            email,
            name,
            department: data.department || undefined,
            whitelist,
            raw: data,
        };

        return normalized;
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('fetchStudentInfo error:', err);
        return null;
    } finally {
        clearTimeout(timeout);
    }
}
