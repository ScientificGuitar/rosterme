using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RosterMeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupAdmins : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GroupAdmins",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClerkUserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupAdmins", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GroupAdmins_Groups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "Groups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GroupAdmins_GroupId",
                table: "GroupAdmins",
                column: "GroupId",
                unique: true,
                filter: "\"Role\" = 'Owner'");

            migrationBuilder.CreateIndex(
                name: "IX_GroupAdmins_GroupId_Email",
                table: "GroupAdmins",
                columns: new[] { "GroupId", "Email" },
                unique: true);

            // Every existing group's owner becomes an Owner-role admin. The
            // owner's name/email are unknown here (GroupOwner was just a Clerk
            // user id); they get filled in from JWT claims the first time that
            // user hits an authenticated endpoint (SyncGroupAdminIdentity).
            migrationBuilder.Sql("""
                INSERT INTO "GroupAdmins" ("Id", "GroupId", "ClerkUserId", "Name", "Email", "Role", "CreatedAt")
                SELECT gen_random_uuid(), "Id", "GroupOwner", NULL, NULL, 'Owner', "CreatedAt"
                FROM "Groups";
                """);

            migrationBuilder.DropIndex(
                name: "IX_Groups_GroupOwner",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "GroupOwner",
                table: "Groups");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GroupOwner",
                table: "Groups",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            // Restore each group's owner id from its Owner-role admin.
            migrationBuilder.Sql("""
                UPDATE "Groups" AS g
                SET "GroupOwner" = owner_meta."ClerkUserId"
                FROM (
                    SELECT "GroupId", "ClerkUserId"
                    FROM "GroupAdmins"
                    WHERE "Role" = 'Owner'
                ) AS owner_meta
                WHERE g."Id" = owner_meta."GroupId"
                  AND owner_meta."ClerkUserId" IS NOT NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Groups_GroupOwner",
                table: "Groups",
                column: "GroupOwner");

            migrationBuilder.DropTable(
                name: "GroupAdmins");
        }
    }
}