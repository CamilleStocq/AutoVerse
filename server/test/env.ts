// Chargé avant chaque fichier de test (--import) : base en mémoire, aucun appel réseau.
process.env.AUTOVERSE_DB = ':memory:';
process.env.AUTOVERSE_OFFLINE = '1';
