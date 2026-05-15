import React from 'react';

const Create: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Crear una Reunión</h1>
      <p className="mb-4">Tu reunión se creará con un ID único</p>
      <button className="btn btn-primary px-4 py-2">
        Crear Reunión
      </button>
      <a href="/" className="mt-4 inline-block text-sm text-blue-500 hover:underline">
        ← Volver al Inicio
      </a>
    </div>
  );
};

export default Create;