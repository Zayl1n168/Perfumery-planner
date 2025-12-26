#include <3ds.h>
#include <stdio.h>
#include <vector>
#include <string>

// Simple structure to hold your perfume ingredients
struct Ingredient {
    std::string name;
    int drops;
};

int main(int argc, char* argv[])
{
    gfxInitDefault();
    consoleInit(GFX_TOP, NULL); // Top screen for info
    PrintConsole bottomScreen;
    consoleInit(GFX_BOTTOM, &bottomScreen); // Bottom screen for "buttons"

    std::vector<Ingredient> recipe = {
        {"Bergamot", 5},
        {"Cedarwood", 3},
        {"Vanilla", 2}
    };

    int selection = 0;

    while (aptMainLoop())
    {
        hidScanInput();
        u32 kDown = hidKeysDown();

        if (kDown & KEY_START) break;

        // Navigation logic
        if (kDown & KEY_DOWN) selection++;
        if (kDown & KEY_UP) selection--;
        if (selection < 0) selection = recipe.size() - 1;
        if (selection >= (int)recipe.size()) selection = 0;

        // Render Top Screen
        consoleSelect(gfxGetConsole(GFX_TOP));
        printf("\x1b[1;1H--- Perfumery Planner 3DS ---");
        printf("\x1b[3;1HCurrent Recipe Layout:");
        
        for(int i=0; i < (int)recipe.size(); i++) {
            if(i == selection) printf("\x1b[%d;1H > %s: %d drops ", i+5, recipe[i].name.c_str(), recipe[i].drops);
            else printf("\x1b[%d;1H   %s: %d drops ", i+5, recipe[i].name.c_str(), recipe[i].drops);
        }

        // Render Bottom Screen (The "Touch" Area)
        consoleSelect(&bottomScreen);
        printf("\x1b[1;1H[ Controls ]");
        printf("\x1b[3;1HUP/DOWN: Select Ingredient");
        printf("\x1b[4;1HA: Increase Drops | B: Decrease");
        
        if (kDown & KEY_A) recipe[selection].drops++;
        if (kDown & KEY_B && recipe[selection].drops > 0) recipe[selection].drops--;

        gfxFlushBuffers();
        gfxSwapBuffers();
        gspWaitForVBlank();
    }

    gfxExit();
    return 0;
}
