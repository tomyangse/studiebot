"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const MaterialContext = createContext();

export function MaterialProvider({ children }) {
  // materials state holds objects: { id, filename, mimeType, base64Data, analysisResult, storagePath, loadedFromDb }
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchUserMaterials = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (mounted) {
          setMaterials([]);
          setLoading(false);
        }
        return;
      }

      // Fetch documents joined with analysis
      const { data: docs, error } = await supabase
        .from('documents')
        .select(`
          id,
          file_name,
          storage_path,
          created_at,
          document_analysis (
            extracted_topics,
            curriculum_mapping,
            overall_coverage
          )
        `)
        .eq('user_id', session.user.id)
        .eq('status', 'done')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching materials from DB:", error);
      } else if (mounted && docs) {
        // Map to our context format
        const mapped = docs.map(d => {
          const analysis = d.document_analysis?.[0];
          return {
            id: d.id,
            filename: d.file_name,
            mimeType: 'application/pdf', // simplified fallback for downloaded files
            storagePath: d.storage_path,
            uploadedAt: d.created_at,
            loadedFromDb: true,
            base64Data: null, // Will be loaded on demand if needed
            analysisResult: analysis ? {
              coveredTopics: analysis.extracted_topics,
              curriculumMapping: analysis.curriculum_mapping,
              overallCoverage: analysis.overall_coverage
            } : null
          };
        });
        setMaterials(mapped);
      }
      
      if (mounted) setLoading(false);
    };

    fetchUserMaterials();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserMaterials();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
    <MaterialContext.Provider value={{ materials, addMaterial, removeMaterial, getMaterialById, loading }}>
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
