import { getUiTranslations, resolvePreferredLanguage } from "../services/translation.service.js";

export const getUiLabels = async (req, res) => {
  const language = resolvePreferredLanguage({
    queryLanguage: req.query.language,
    userLanguage: req.user?.preferredLanguage,
  });

  const labels = await getUiTranslations(language);

  res.status(200).json({
    ok: true,
    language,
    labels,
  });
};
