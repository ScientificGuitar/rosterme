using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RosterMeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddRemovalEmailPolicy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RemovalEmailPolicy",
                table: "Events",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Ask");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RemovalEmailPolicy",
                table: "Events");
        }
    }
}
