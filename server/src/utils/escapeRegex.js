// Makes user text safe to use inside a MongoDB $regex (SEC-06): "a.b" matches only "a.b"
export const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
