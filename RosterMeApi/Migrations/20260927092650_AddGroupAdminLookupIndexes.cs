using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RosterMeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupAdminLookupIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_GroupAdmins_ClerkUserId",
                table: "GroupAdmins",
                column: "ClerkUserId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupAdmins_GroupId_ClerkUserId",
                table: "GroupAdmins",
                columns: new[] { "GroupId", "ClerkUserId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_GroupAdmins_ClerkUserId",
                table: "GroupAdmins");

            migrationBuilder.DropIndex(
                name: "IX_GroupAdmins_GroupId_ClerkUserId",
                table: "GroupAdmins");
        }
    }
}
