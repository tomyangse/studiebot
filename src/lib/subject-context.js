"use client";

import { createContext, useContext, useState } from "react";
import {
  CURRICULUM_MAP,
  AVAILABLE_SUBJECTS,
  HISTORIA_1B_CURRICULUM,
} from "@/lib/curriculum-data";

const SubjectContext = createContext(null);

export function SubjectProvider({ children }) {
  const [activeSubjectKey, setActiveSubjectKey] = useState("HIS:Historia 1b");

  const curriculum = CURRICULUM_MAP[activeSubjectKey] || HISTORIA_1B_CURRICULUM;
  const activeSubject = AVAILABLE_SUBJECTS.find(
    (s) => `${s.code}:${s.levelName}` === activeSubjectKey
  ) || AVAILABLE_SUBJECTS[0];

  const switchSubject = (code, levelName) => {
    setActiveSubjectKey(`${code}:${levelName}`);
  };

  return (
    <SubjectContext.Provider
      value={{
        activeSubject,
        activeSubjectKey,
        curriculum,
        subjects: AVAILABLE_SUBJECTS,
        switchSubject,
      }}
    >
      {children}
    </SubjectContext.Provider>
  );
}

export function useSubject() {
  const ctx = useContext(SubjectContext);
  if (!ctx) throw new Error("useSubject must be inside SubjectProvider");
  return ctx;
}
