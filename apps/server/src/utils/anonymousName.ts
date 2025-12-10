import crypto from "crypto";

import { getSecret } from "../secretPass";
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
  const secret = getSecret();
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
