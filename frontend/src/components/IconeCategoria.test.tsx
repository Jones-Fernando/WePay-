import { act } from "react";
import { createRoot, type Root } from "test-renderer";
import { ICONES_CATEGORIA } from "@/constants/financeCategories";
import { View } from "react-native";
import { IconeCategoria } from "./IconeCategoria";

jest.mock("react-native", () => ({
  Image: "Image",
  Text: "Text",
  View: "View",
}));

describe("IconeCategoria", () => {
  let root: Root | undefined;

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
      root = undefined;
    }
  });

  it("uses an Icons8 image for every available category icon", async () => {
    const currentRoot = createRoot();
    root = currentRoot;

    await act(async () => {
      currentRoot.render(
        <View>
          {ICONES_CATEGORIA.map((icone) => (
            <IconeCategoria key={icone} icone={icone} />
          ))}
        </View>,
      );
    });

    expect(
      currentRoot.container.queryAll((instance) => instance.type === "Image"),
    ).toHaveLength(ICONES_CATEGORIA.length);
    expect(
      currentRoot.container.queryAll((instance) => instance.type === "Text"),
    ).toHaveLength(0);
  });

  it("keeps the emoji fallback for an unsupported icon", async () => {
    const currentRoot = createRoot();
    root = currentRoot;

    await act(async () => {
      currentRoot.render(<IconeCategoria icone="🌈" />);
    });

    expect(
      currentRoot.container.queryAll((instance) => instance.type === "Image"),
    ).toHaveLength(0);
    expect(
      currentRoot.container.queryAll((instance) => instance.type === "Text"),
    ).toHaveLength(1);
  });
});
