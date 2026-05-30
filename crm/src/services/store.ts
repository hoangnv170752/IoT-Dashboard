import { Contact, Company, Deal, Activity } from '../types/index.js';

class Store {
  contacts: Map<string, Contact> = new Map();
  companies: Map<string, Company> = new Map();
  deals: Map<string, Deal> = new Map();
  activities: Map<string, Activity> = new Map();
}

export const store = new Store();
