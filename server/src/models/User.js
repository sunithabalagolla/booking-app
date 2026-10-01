import mongoose from 'mongoose'

// users collection (database.md 5.1): all 4 roles in one collection
const { Schema } = mongoose

export const ROLES = ['user', 'owner', 'staff', 'admin']
export const THEMES = ['auto', 'day', 'night']
export const BADGE_CODES = ['first_show', 'regular', 'silver_jubilee', 'golden_jubilee', 'diamond_jubilee']

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    // bcrypt hash (SEC-01). Not loaded unless asked for with .select('+passwordHash')
    passwordHash: { type: String, select: false },
    // Set when the password changes (U-03). Access tokens made before this are refused.
    passwordChangedAt: Date,
    role: { type: String, enum: ROLES, required: true, default: 'user' },
    phone: { type: String, trim: true },
    emailVerified: { type: Boolean, required: true, default: false }, // U-01, O-01
    status: { type: String, enum: ['active', 'blocked'], required: true, default: 'active' },

    // Only for role 'owner' (O-01, ROLE-03)
    owner: {
      type: new Schema(
        {
          businessName: { type: String, required: true, trim: true },
          approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], required: true, default: 'pending' },
          rejectReason: String,
          decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
          decidedAt: Date,
        },
        { _id: false },
      ),
      default: undefined,
    },

    // Only for role 'staff' (ROLE-05)
    staff: {
      type: new Schema(
        {
          ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          theatreIds: [{ type: Schema.Types.ObjectId, ref: 'Theatre' }],
        },
        { _id: false },
      ),
      default: undefined,
    },

    // UI-02, UI-40, UI-41
    prefs: {
      theme: { type: String, enum: THEMES, default: 'auto' },
      sound: { type: Boolean, default: false },
      reduceMotion: { type: Boolean, default: false },
    },

    enteredCount: { type: Number, required: true, default: 0 }, // BR-23
    badges: [
      {
        _id: false,
        code: { type: String, enum: BADGE_CODES, required: true },
        earnedAt: { type: Date, required: true },
      },
    ],
    deletedAt: Date, // U-26
  },
  {
    timestamps: true,
    // Never send the password hash, even if it was loaded
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash
        delete ret.__v
        return ret
      },
    },
  },
)

userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ role: 1, 'owner.approvalStatus': 1 })
userSchema.index({ 'staff.theatreIds': 1 })

export const User = mongoose.model('User', userSchema)
