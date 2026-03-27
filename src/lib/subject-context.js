"use client";

import { createContext, useContext, useState, useCallback } from "react";
import {
  CURRICULUM_MAP,
  AVAILABLE_SUBJECTS,
  HISTORIA_1B_CURRICULUM,
} from "@/lib/curriculum-data";

const SubjectContext = createContext(null);

export function SubjectProvider({ children }) {
  const [activeSubjectKey, setActiveSubjectKey] = useState("HIS:Historia 1b");
  // Custom curricula added by the user at runtime
  const [customCurricula, setCustomCurricula] = useState({});
  // Extra subject entries added by the user
  const [customSubjects, setCustomSubjects] = useState([]);

  const allCurricula = { ...CURRICULUM_MAP, ...customCurricula };
  const allSubjects = [...AVAILABLE_SUBJECTS, ...customSubjects];

  const curriculum = allCurricula[activeSubjectKey] || HISTORIA_1B_CURRICULUM;
  const activeSubject = allSubjects.find(
    (s) => `${s.code}:${s.levelName}` === activeSubjectKey
  ) || AVAILABLE_SUBJECTS[0];

  const switchSubject = useCallback((code, levelName) => {
    setActiveSubjectKey(`${code}:${levelName}`);
  }, []);

  const addSubject = useCallback((curriculumData) => {
    const key = `${curriculumData.subjectCode}:${curriculumData.levelName}`;

    // Add to custom curricula
    setCustomCurricula((prev) => ({ ...prev, [key]: curriculumData }));

    // Add to custom subjects list (avoid duplicates)
    setCustomSubjects((prev) => {
      if (prev.some((s) => `${s.code}:${s.levelName}` === key)) return prev;
      return [
        ...prev,
        {
          code: curriculumData.subjectCode,
          levelName: curriculumData.levelName,
          icon: curriculumData.icon,
          points: curriculumData.points,
          isCustom: true,
        },
      ];
    });

    // Auto-switch to the new subject
    setActiveSubjectKey(key);
  }, []);

  const removeSubject = useCallback(
    (code, levelName) => {
      const key = `${code}:${levelName}`;
      setCustomCurricula((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setCustomSubjects((prev) =>
        prev.filter((s) => `${s.code}:${s.levelName}` !== key)
      );
      // If we removed the active subject, switch back to default
      if (activeSubjectKey === key) {
        setActiveSubjectKey("HIS:Historia 1b");
      }
    },
    [activeSubjectKey]
  );

  return (
    <SubjectContext.Provider
      value={{
        activeSubject,
        activeSubjectKey,
        curriculum,
        subjects: allSubjects,
        switchSubject,
        addSubject,
        removeSubject,
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
