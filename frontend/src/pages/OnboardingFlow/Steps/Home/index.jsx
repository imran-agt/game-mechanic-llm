import { useState } from "react";
import paths from "@/utils/paths";
import LGroupImg from "./l_group.png";
import RGroupImg from "./r_group.png";
import LGroupImgLight from "./l_group-light.png";
import RGroupImgLight from "./r_group-light.png";
import AnythingLLMLogo from "@/media/logo/anything-llm.png";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";
import System from "@/models/system";

const IMG_SRCSET = {
  light: {
    l: LGroupImgLight,
    r: RGroupImgLight,
  },
  default: {
    l: LGroupImg,
    r: RGroupImg,
  },
};

const DEFAULT_SETTINGS = {
  LLMProvider: "lmstudio",
  LMStudioBasePath: "http://localhost:5000/v1",
  EmbeddingEngine: "lmstudio",
  EmbeddingBasePath: "http://127.0.0.1:5000/v1",
  EmbeddingModelPref: "Qwen3-Embedding-0.6B-Q8_0",
  EmbeddingModelMaxChunkLength: "8192",
  VectorDB: "qdrant",
  QdrantEndpoint: "http://localhost:6333",
};

export default function OnboardingHome() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const srcSet = IMG_SRCSET?.[theme] || IMG_SRCSET.default;
  const [configuring, setConfiguring] = useState(false);

  async function handleGetStarted() {
    setConfiguring(true);
    try {
      const { newValues, error } =
        await System.updateSystem(DEFAULT_SETTINGS);
      if (newValues) {
        navigate(paths.onboarding.createWorkspace());
      } else {
        console.error("Auto-setup failed:", error);
        navigate(paths.onboarding.llmPreference());
      }
    } catch (e) {
      console.error("Auto-setup error:", e);
      navigate(paths.onboarding.llmPreference());
    }
  }

  return (
    <>
      <div className="relative w-screen h-screen flex overflow-hidden bg-theme-bg-primary">
        <div
          className="hidden md:block fixed bottom-10 left-10 w-[320px] h-[320px] bg-no-repeat bg-contain"
          style={{ backgroundImage: `url(${srcSet.l})` }}
        ></div>

        <div
          className="hidden md:block fixed top-10 right-10 w-[320px] h-[320px] bg-no-repeat bg-contain"
          style={{ backgroundImage: `url(${srcSet.r})` }}
        ></div>

        <div className="relative flex justify-center items-center m-auto">
          <div className="flex flex-col justify-center items-center">
            <p className="text-theme-text-primary font-thin text-[24px]">
              {t("onboarding.home.title")}
            </p>
            <img
              src={AnythingLLMLogo}
              alt="AnythingLLM"
              className="md:h-[50px] flex-shrink-0 max-w-[300px] light:invert"
            />
            {configuring ? (
              <div className="flex flex-col items-center my-10">
                <div className="w-8 h-8 border-4 border-theme-text-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-theme-text-primary text-sm mt-4">
                  Setting up defaults...
                </p>
              </div>
            ) : (
              <button
                onClick={handleGetStarted}
                className="border-[2px] border-theme-text-primary animate-pulse light:animate-none w-full md:max-w-[350px] md:min-w-[300px] text-center py-3 bg-theme-button-primary hover:bg-theme-bg-secondary text-theme-text-primary font-semibold text-sm my-10 rounded-md"
              >
                {t("onboarding.home.getStarted")}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
