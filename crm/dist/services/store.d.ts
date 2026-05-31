import { Contact, Company, Deal, Activity } from '../types/index.js';
declare class Store {
    contacts: Map<string, Contact>;
    companies: Map<string, Company>;
    deals: Map<string, Deal>;
    activities: Map<string, Activity>;
}
export declare const store: Store;
export {};
//# sourceMappingURL=store.d.ts.map