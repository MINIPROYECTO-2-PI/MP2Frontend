import React from 'react';

const Home: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Meet Clone</h1>
      <p className="mb-6">Bienvenido a la aplicación de videoconferencias</p>
      <nav className="space-y-2">
        <a href="/join" className="btn btn-primary px-4 py-2">Unirse a una Reunión</a>
        <a href="/create" className="btn btn-secondary px-4 py-2">Crear una Reunión</a>
      </nav>
    </div>
  );
};

export default Home;