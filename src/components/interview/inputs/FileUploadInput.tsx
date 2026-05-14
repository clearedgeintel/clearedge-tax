"use client";

import { useController, type Control } from "react-hook-form";
import { Upload } from "lucide-react";

interface Props {
  name: string;
  control: Control<Record<string, unknown>>;
}

export default function FileUploadInput({ name, control }: Props) {
  const { field } = useController({ name, control });

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
      <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
      <p className="text-sm text-gray-600 mb-1">
        Drag and drop a file here, or click to browse
      </p>
      <p className="text-xs text-gray-400">
        Document uploads are managed through the Documents section
      </p>
      <input
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            field.onChange({ fileName: file.name, fileSize: file.size });
          }
        }}
      />
    </div>
  );
}
