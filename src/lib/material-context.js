"use client";

import { createContext, useContext, useState } from "react";

const MaterialContext = createContext();

export function MaterialProvider({ children }) {
  // materials state holds objects: { id, filename, mimeType, base64Data, analysisResult }
  const [materials, setMaterials] = useState([]);

  const addMaterial = (newMaterial) => {
    setMaterials((prev) => [
      ...prev,
      {
        ...newMaterial,
        id: newMaterial.id || crypto.randomUUID(),
        uploadedAt: new Date().toISOString(),
      },
    ]);
  };

  const removeMaterial = (id) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  const getMaterialById = (id) => {
    return materials.find((m) => m.id === id);
  };

  return (
    <MaterialContext.Provider value={{ materials, addMaterial, removeMaterial, getMaterialById }}>
      {children}
    </MaterialContext.Provider>
  );
}

export function useMaterial() {
  const context = useContext(MaterialContext);
  if (context === undefined) {
    throw new Error("useMaterial must be used within a MaterialProvider");
  }
  return context;
}
