#include <3ds.h>
#include <stdio.h>
#include <vector>
#include <string>

struct Ingredient {
    std::string name;
    int drops;
};

int main(int argc, char* argv[])
{
    gfxInitDefault();

    // 1. Initialize two consoles: one for Top, one for Bottom
    PrintConsole topConsole, bottomConsole;
    consoleInit(GFX_TOP, &topConsole);
    consoleInit(GFX_BOTTOM, &bottomConsole);

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

        // Selection Logic
        if (kDown & KEY_DOWN) selection++;
        if (kDown & KEY_UP) selection--;
        if (selection < 0) selection = recipe.size() - 1;
        if (selection >= (int)recipe.size()) selection = 0;

        // Increase/Decrease Drops
        if (kDown & KEY_A) recipe[selection].drops++;
        if (kDown & KEY_B && recipe[selection].drops > 0) recipe[selection].drops--;

        // --- Render Top Screen ---
        consoleSelect(&topConsole);
        printf("\x1b[1;1H--- Perfumery Planner 3DS ---");
        printf("\x1b[3;1HCurrent Recipe Layout:");
        
        for(int i=0; i < (int)recipe.size(); i++) {
            // \x1b[line;columnH is used to position the text
            if(i == selection) 
                printf("\x1b[%d;1H > %-15s: %2d drops ", i+5, recipe[i].name.c_str(), recipe[i].drops);
            else 
                printf("\x1b[%d;1H   %-15s: %2d drops ", i+5, recipe[i].name.c_str(), recipe[i].drops);
        }

        // --- Render Bottom Screen ---
        consoleSelect(&bottomConsole);
        printf("\x1b[1;1H[ Controls ]");
        printf("\x1b[3;1HUP/DOWN: Select Ingredient");
        printf("\x1b[4;1HA: Increase | B: Decrease");
        printf("\x1b[10;1HPress START to exit");

        gfxFlushBuffers();
        gfxSwapBuffers();
        gspWaitForVBlank();
    }

    gfxExit();
    return 0;
}
