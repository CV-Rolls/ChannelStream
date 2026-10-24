import { useState, useEffect } from "react";

const FAVORITES_KEY = "iptv_favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (err) {
      console.error("Failed to load favorites", err);
    }
  }, []);

  const toggleFavorite = (channelId: string) => {
    setFavorites((prev) => {
      const newFavorites = prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId];
      
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      } catch (err) {
        console.error("Failed to save favorites", err);
      }
      
      return newFavorites;
    });
  };

  const isFavorite = (channelId: string) => favorites.includes(channelId);

  return { favorites, toggleFavorite, isFavorite };
}
