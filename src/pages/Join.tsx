import React from 'react';

const Join: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Unirse a una Reunión</h1>
      <form className="space-y-4">
        <div>
          <label htmlFor="meetingId" className="block text-sm font-medium mb-1">
            ID de la Reunión
          </label>
          <input
            type="text"
            id="meetingId"
            placeholder="Ingresa el ID de la reunión"
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <button type="submit" className="w-full btn btn-primary px-4 py-2">
          Unirse a la Reunión
        </button>
      </form>
      <a href="/" className="mt-4 inline-block text-sm text-blue-500 hover:underline">
        ← Volver al Inicio
      </a>
    </div>
  );
};

export default Join;