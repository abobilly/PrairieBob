namespace BobTile.Services;

public interface IDialogService
{
    string? BrowseFolder(string? initialPath = null);
    string[]? SelectImageFiles(string? initialPath = null);
    int? PromptForInt(string title, string message, int initialValue);
    void ShowError(string title, string message);
    void ShowInfo(string title, string message);
    bool Confirm(string title, string message);
}
