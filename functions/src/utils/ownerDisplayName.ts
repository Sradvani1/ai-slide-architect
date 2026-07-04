export const getOwnerDisplayName = (ownerData?: { displayName?: string | null; email?: string | null }) => {
    const name = ownerData?.displayName?.trim();
    if (name) return name;
    const email = ownerData?.email?.trim();
    if (!email) return 'A teacher';
    return email.split('@')[0] || 'A teacher';
};
