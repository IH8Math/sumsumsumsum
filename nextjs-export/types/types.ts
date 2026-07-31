export interface Staff {
  id?: string;
  name: string;
  department: string;
  position: string;
}

export interface RequiredTraining {
  id: string;
  courseName: string;
  department: string;
  deadline: string;
  managerName?: string;
}

export interface CompletionRecord {
  id: string;
  courseName: string;
  name: string;
  hours: number;
  year: number;
  completedAt: string;
}

export interface AppState {
  staff: Staff[];
  requiredTrainings: RequiredTraining[];
  completedTrainings: CompletionRecord[];
}
