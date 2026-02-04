import React, { useState } from 'react';
import SearchMenu from '../components/SearchMenu';

const Dashboard: React.FC = () => {
  const [results, setResults] = useState<string[]>([]);

  const handleSearch = async (query: string) => {
    const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
    if (response.ok) {
      const data = await response.json();
      setResults(data.results);
    }
  };

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <SearchMenu onSearch={handleSearch} />
      <div className="search-results">
        <ul>
          {results.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;
