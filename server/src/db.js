import mongoose from 'mongoose';
mongoose.set('bufferCommands', true);

let connected = false;

export function useMongo() {
  return !!process.env.MONGODB_URI;
}

export async function connectDB() {
  if (!useMongo() || connected) return true;
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      tls: true,
      family: 4,
    });
    connected = true;
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('MongoDB connection failed:', e?.message || e);
    connected = false;
    return false;
  }
}

const HistorySchema = new mongoose.Schema({
  version: Number,
  content: String,
  at: { type: Date, default: Date.now },
  email: String,
}, { _id: false });

const DocumentSchema = new mongoose.Schema({
  docId: { type: String, required: true, unique: true, index: true },
  content: { type: String, default: '' },
  version: { type: Number, default: 0 },
  ownerEmail: { type: String },
  collaborators: { type: [String], default: [] },
  pendingJoinRequests: [{
    email: { type: String, required: true },
    username: { type: String, required: true },
    requestedAt: { type: Date, default: Date.now }
  }],
  history: { type: [HistorySchema], default: [] },
}, { timestamps: true });

export const DocumentModel = mongoose.models.Document || mongoose.model('Document', DocumentSchema);

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, unique: true, index: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true });

export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
