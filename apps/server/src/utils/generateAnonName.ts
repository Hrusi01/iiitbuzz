import crypto from "crypto";
import { env } from "@/envSchema"; // wherever you load env vars

const animals = [
  "Tiger", "Wolf", "Falcon", "Panther", "Phoenix", "Leopard", "Eagle", "Raven",
  "Cobra", "Viper", "Hawk", "Dragon", "Lynx", "Jaguar", "Shark", "Stallion",
  "Owl", "Rhino", "Bear", "Panda", "Griffin", "Kraken", "Hydra", "Fox",
  "Bison", "Cheetah", "Gorilla", "Turtle", "Scorpion", "Mantis"
];

const adjectives = [
  "Shadow", "Silent", "Ghost", "Crimson", "Blue", "Iron", "Night", "Frost",
  "Storm", "Electric", "Golden", "Cyber", "Wild", "Atomic", "Nebula", "Lunar",
  "Solar", "Thunder", "Noble", "Brave", "Swift", "Hidden", "Obsidian",
  "Phantom", "Radiant", "Mystic", "Silver", "Scarlet", "Feral", "Arcane"
];


export function generateAnonName(userId: string, threadId: string): string {
  const secret = env.ANON_SECRET_KEY || "A9fK2xP7QwL8Rt3ZmX7pQ2sT9vB4nR6HZ4r!Q8u#P2k@M6yNp7L3vR9Qw2Xy6BfT";
  const seed = `${userId}-${threadId}`;
  const hash = crypto
    .createHmac("sha256", secret)
    .update(seed)
    .digest("hex");
  const adjIndex = parseInt(hash.substring(0, 8), 16) % adjectives.length;
  const animalIndex = parseInt(hash.substring(8, 16), 16) % animals.length;
  const num = parseInt(hash.substring(16, 20), 16) % 100;
  return `${adjectives[adjIndex]}${animals[animalIndex]}${num}`;
}
