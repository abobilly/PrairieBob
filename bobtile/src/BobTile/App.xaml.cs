using System.Configuration;
using System.Data;
using System.Windows;

namespace BobTile;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : Application
{
	public static IReadOnlyList<string> StartupArguments { get; private set; } = Array.Empty<string>();

	protected override void OnStartup(StartupEventArgs e)
	{
		StartupArguments = e.Args ?? Array.Empty<string>();
		base.OnStartup(e);
	}
}

